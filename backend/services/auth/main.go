package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"uniloop/backend/internal/auth"
	"uniloop/backend/internal/config"
	"uniloop/backend/internal/db"
	"uniloop/backend/internal/middleware"
	"uniloop/backend/pkg/cache"
	"uniloop/backend/pkg/messaging"
)

func main() {
	cfg := config.Load()

	if cfg.RabbitMQURL == "" {
		log.Fatal("RABBITMQ_URL is required for auth service")
	}

	pool, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()
	log.Println("[auth-service] database connected")

	// Connect to RabbitMQ with indefinite retry
	pub, err := messaging.NewPublisher(cfg.RabbitMQURL, 0)
	if err != nil {
		log.Fatalf("rabbitmq: %v", err)
	}
	defer pub.Close()
	log.Println("[auth-service] rabbitmq connected")

	var cacheClient *cache.Client
	if cfg.RedisURL != "" {
		if c, err := cache.New(cfg.RedisURL); err == nil {
			cacheClient = c
			defer cacheClient.Close()
			log.Println("[auth-service] redis connected for cache invalidation")
		} else {
			log.Printf("[auth-service] redis unavailable, cache invalidation disabled: %v", err)
		}
	}

	authSvc := auth.NewService(pool, cfg, pub, cacheClient)
	authHandler := auth.NewHandler(authSvc)

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = cfg.AllowedOrigins
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	r.Use(cors.New(corsConfig))

	r.Use(middleware.RateLimit(5, 10))

	a := r.Group("/api/auth")
	{
		a.POST("/register", authHandler.Register)
		a.POST("/login", authHandler.Login)

		authed := a.Group("", middleware.Auth(cfg.JWTSecret))
		authed.GET("/me", authHandler.Me)
		authed.POST("/send-otp", authHandler.SendOTP)
		authed.POST("/verify-otp", authHandler.VerifyOTP)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "auth"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	log.Printf("[auth-service] listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server: %v", err)
	}
}
