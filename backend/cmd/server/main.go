package main

import (
	"log"

	"uniloop/backend/internal/app"
	"uniloop/backend/internal/config"
)

func main() {
	cfg := config.Load()
	server, err := app.NewMonolith(cfg)
	if err != nil {
		log.Fatalf("bootstrap server: %v", err)
	}
	defer server.Close()

	log.Printf("server listening on :%s", cfg.Port)
	if err := server.Router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server: %v", err)
	}
}
