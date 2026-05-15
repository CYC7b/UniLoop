package app

import (
	"context"
	"fmt"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"uniloop/backend/internal/admin"
	"uniloop/backend/internal/auth"
	"uniloop/backend/internal/config"
	"uniloop/backend/internal/conversation"
	"uniloop/backend/internal/db"
	"uniloop/backend/internal/favorite"
	"uniloop/backend/internal/middleware"
	"uniloop/backend/internal/product"
	"uniloop/backend/internal/profile"
	"uniloop/backend/internal/report"
	"uniloop/backend/internal/storage"
	"uniloop/backend/internal/ws"
	"uniloop/backend/pkg/cache"
	"uniloop/backend/pkg/messaging"
)

type Server struct {
	Router  *gin.Engine
	closers []func()
}

func (s *Server) Close() {
	for i := len(s.closers) - 1; i >= 0; i-- {
		s.closers[i]()
	}
}

func NewCore(cfg *config.Config) (*Server, error) {
	return newServer(cfg, false)
}

func NewMonolith(cfg *config.Config) (*Server, error) {
	return newServer(cfg, true)
}

func newServer(cfg *config.Config, includeAuth bool) (*Server, error) {
	ctx := context.Background()
	store := storage.NewLocal(cfg.UploadDir)
	if err := store.EnsureDirs(ctx, "products", "avatars", "docs", "thumbnails"); err != nil {
		return nil, fmt.Errorf("create upload dir: %w", err)
	}

	pool, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("db connect: %w", err)
	}
	closers := []func(){pool.Close}

	admin.EnsureSchema(pool)
	admin.SeedAdmin(pool, cfg.AdminEmail, cfg.AdminPassword)

	var cacheClient *cache.Client
	if cfg.RedisURL != "" {
		if c, err := cache.New(cfg.RedisURL); err == nil {
			cacheClient = c
			closers = append(closers, func() { _ = cacheClient.Close() })
			log.Println("[core-service] redis connected for distributed caching")
		} else {
			log.Printf("[core-service] redis unavailable, caching disabled: %v", err)
		}
	}

	var pub messaging.EventPublisher
	if cfg.RabbitMQURL != "" {
		if p, err := messaging.NewPublisher(cfg.RabbitMQURL, 10); err == nil {
			pub = p
			closers = append(closers, p.Close)
			log.Println("[core-service] rabbitmq connected for event publishing")
		} else {
			log.Printf("[core-service] rabbitmq unavailable, notifications disabled: %v", err)
		}
	}

	productRepo := product.NewRepository(pool, cacheClient)
	profileRepo := profile.NewRepository(pool, cacheClient)
	convRepo := conversation.NewRepository(pool, cacheClient)
	hub := ws.NewHub()

	var authHandler *auth.Handler
	if includeAuth {
		authSvc := auth.NewService(pool, cfg, pub, cacheClient)
		authHandler = auth.NewHandler(authSvc)
	}

	productHandler := product.NewHandler(productRepo, store)
	profileHandler := profile.NewHandler(profileRepo, productRepo, store)
	convService := conversation.NewService(convRepo, productRepo, profileRepo, hub, pub)
	convHandler := conversation.NewHandler(convService)
	favService := favorite.NewService(favorite.NewRepository(pool), productRepo)
	favHandler := favorite.NewHandler(favService)
	reportService := report.NewService(report.NewRepository(pool), pub, cfg.AdminEmail)
	reportHandler := report.NewHandler(reportService)
	wsHandler := ws.NewWSHandler(hub, cfg.JWTSecret)
	adminHandler := admin.NewHandler(admin.NewRepository(pool, cacheClient))

	router := newBaseRouter(cfg)
	router.Static("/uploads", store.Root())
	if authHandler != nil {
		registerAuthRoutes(router, cfg, authHandler)
	}
	registerCoreRoutes(router, cfg, productHandler, profileHandler, convHandler, favHandler, reportHandler, wsHandler, adminHandler)

	return &Server{Router: router, closers: closers}, nil
}

func newBaseRouter(cfg *config.Config) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = cfg.AllowedOrigins
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	r.Use(cors.New(corsConfig))
	r.Use(middleware.RateLimit(20, 40))
	return r
}

func registerAuthRoutes(r *gin.Engine, cfg *config.Config, authHandler *auth.Handler) {
	a := r.Group("/api/auth")
	a.Use(middleware.RateLimit(5, 10))
	{
		a.POST("/register", authHandler.Register)
		a.POST("/login", authHandler.Login)

		authed := a.Group("", middleware.Auth(cfg.JWTSecret))
		authed.GET("/me", authHandler.Me)
		authed.POST("/send-otp", authHandler.SendOTP)
		authed.POST("/verify-otp", authHandler.VerifyOTP)
	}
}

func registerCoreRoutes(
	r *gin.Engine,
	cfg *config.Config,
	productHandler *product.Handler,
	profileHandler *profile.Handler,
	convHandler *conversation.Handler,
	favHandler *favorite.Handler,
	reportHandler *report.Handler,
	wsHandler *ws.WSHandler,
	adminHandler *admin.Handler,
) {
	p := r.Group("/api/products")
	{
		p.GET("", productHandler.List)
		p.GET("/locations", productHandler.Locations)
		p.GET("/:id", productHandler.GetOne)
		authed := p.Group("", middleware.Auth(cfg.JWTSecret))
		authed.POST("", productHandler.Create)
		authed.PUT("/:id", productHandler.Update)
		authed.DELETE("/:id", productHandler.Delete)
	}

	r.POST("/api/uploads/images", middleware.Auth(cfg.JWTSecret), productHandler.UploadImages)
	r.GET("/api/profiles/:id", profileHandler.GetPublic)

	me := r.Group("/api/me", middleware.Auth(cfg.JWTSecret))
	{
		me.PUT("/profile", profileHandler.UpdateMe)
		me.POST("/avatar", profileHandler.UploadAvatar)
		me.POST("/verify-doc", profileHandler.SubmitVerifyDoc)
	}

	fav := r.Group("/api/favorites", middleware.Auth(cfg.JWTSecret))
	{
		fav.GET("", favHandler.List)
		fav.GET("/ids", favHandler.GetIDs)
		fav.POST("", favHandler.Add)
		fav.DELETE("/:productId", favHandler.Remove)
	}

	conv := r.Group("/api/conversations", middleware.Auth(cfg.JWTSecret))
	{
		conv.GET("", convHandler.List)
		conv.POST("", convHandler.Create)
		conv.GET("/unread", convHandler.UnreadCount)
		conv.GET("/:id", convHandler.GetOne)
		conv.POST("/:id/messages", convHandler.SendMessage)
		conv.PUT("/:id/read", convHandler.MarkRead)
		conv.DELETE("/:id", convHandler.Delete)
	}

	r.POST("/api/reports", middleware.Auth(cfg.JWTSecret), reportHandler.Create)

	adm := r.Group("/api/admin", middleware.Auth(cfg.JWTSecret), middleware.AdminOnly())
	{
		adm.GET("/stats", adminHandler.Stats)
		adm.GET("/users", adminHandler.ListUsers)
		adm.PUT("/users/:id/verification", adminHandler.UpdateUserVerification)
		adm.DELETE("/users/:id", adminHandler.DeleteUser)
		adm.GET("/products", adminHandler.ListProducts)
		adm.PUT("/products/:id/status", adminHandler.UpdateProductStatus)
		adm.DELETE("/products/:id", adminHandler.DeleteProduct)
		adm.GET("/reports", adminHandler.ListReports)
		adm.PUT("/reports/:id/resolve", adminHandler.ResolveReport)
		adm.DELETE("/reports/:id", adminHandler.DeleteReport)
	}

	r.GET("/ws", wsHandler.ServeWS)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "core"})
	})
}
