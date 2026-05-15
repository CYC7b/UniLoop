package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL    string
	JWTSecret      string
	Port           string
	UploadDir      string
	BaseURL        string
	SMTPHost       string
	SMTPPort       int
	SMTPUser       string
	SMTPPassword   string
	SMTPFrom       string
	OTPExpirySecs  int
	AdminEmail     string
	AdminPassword  string
	AllowedOrigins []string
	RabbitMQURL    string
	RedisURL       string
}

func Load() *Config {
	_ = godotenv.Load()

	smtpPort, _ := strconv.Atoi(getEnv("SMTP_PORT", "587"))
	otpExpiry, _ := strconv.Atoi(getEnv("OTP_EXPIRY_SECS", "600"))

	cfg := &Config{
		DatabaseURL:    mustEnv("DATABASE_URL"),
		JWTSecret:      mustEnv("JWT_SECRET"),
		Port:           getEnv("PORT", "8080"),
		UploadDir:      getEnv("UPLOAD_DIR", "./uploads"),
		BaseURL:        getEnv("BASE_URL", "http://localhost:8080"),
		SMTPHost:       getEnv("SMTP_HOST", ""),
		SMTPPort:       smtpPort,
		SMTPUser:       getEnv("SMTP_USER", ""),
		SMTPPassword:   getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:       getEnv("SMTP_FROM", "noreply@example.com"),
		OTPExpirySecs:  otpExpiry,
		AdminEmail:     getEnv("ADMIN_EMAIL", ""),
		AdminPassword:  getEnv("ADMIN_PASSWORD", ""),
		AllowedOrigins: splitOrigins(getEnv("ALLOWED_ORIGINS", "http://localhost:5173")),
		RabbitMQURL:    getEnv("RABBITMQ_URL", ""),
		RedisURL:       getEnv("REDIS_URL", ""),
	}
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitOrigins(s string) []string {
	parts := strings.Split(s, ",")
	var origins []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			origins = append(origins, p)
		}
	}
	return origins
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env var %s is not set", key)
	}
	return v
}
