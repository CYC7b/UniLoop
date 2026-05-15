package main

import (
	"log"
	"os"

	"uniloop/backend/internal/app"
	"uniloop/backend/internal/config"
)

func main() {
	cfg := config.Load()
	server, err := app.NewCore(cfg)
	if err != nil {
		log.Fatalf("bootstrap core service: %v", err)
	}
	defer server.Close()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}
	log.Printf("[core-service] listening on :%s", port)
	if err := server.Router.Run(":" + port); err != nil {
		log.Fatalf("server: %v", err)
	}
}
