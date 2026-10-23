package main

import (
	"context"
	"log"
	"os"

	"github.com/joho/godotenv"
	"uniloop/backend/internal/db"
)

func main() {
	_ = godotenv.Load()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("required env var DATABASE_URL is not set")
	}

	pool, err := db.Connect(databaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(context.Background(), pool); err != nil {
		log.Fatalf("%v", err)
	}
	log.Println("migrations up to date")
}
