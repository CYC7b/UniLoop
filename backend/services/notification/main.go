package main

import (
	"encoding/json"
	"log"
	"os"
	"strconv"

	"gopkg.in/gomail.v2"
	"uniloop/backend/pkg/messaging"
)

func main() {
	rabbitURL := os.Getenv("RABBITMQ_URL")
	if rabbitURL == "" {
		log.Fatal("RABBITMQ_URL is required")
	}
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort, _ := strconv.Atoi(os.Getenv("SMTP_PORT"))
	if smtpPort == 0 {
		smtpPort = 587
	}
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASSWORD")
	smtpFrom := os.Getenv("SMTP_FROM")
	if smtpFrom == "" {
		smtpFrom = "noreply@example.com"
	}

	log.Println("[notification-service] connecting to RabbitMQ...")
	consumer, err := messaging.NewConsumer(rabbitURL)
	if err != nil {
		log.Fatalf("consumer: %v", err)
	}
	defer consumer.Close()
	log.Println("[notification-service] ready, waiting for email events")

	deliveries, err := consumer.Consume()
	if err != nil {
		log.Fatalf("consume: %v", err)
	}

	dialer := gomail.NewDialer(smtpHost, smtpPort, smtpUser, smtpPass)

	for d := range deliveries {
		var event messaging.EmailEvent
		if err := json.Unmarshal(d.Body, &event); err != nil {
			log.Printf("[notification-service] bad message: %v — discarding", err)
			d.Nack(false, false)
			continue
		}

		log.Printf("[notification-service] sending %s → %s", event.EventType, event.To)
		m := gomail.NewMessage()
		m.SetHeader("From", smtpFrom)
		m.SetHeader("To", event.To)
		m.SetHeader("Subject", event.Subject)
		m.SetBody("text/plain", event.Body)

		if err := dialer.DialAndSend(m); err != nil {
			log.Printf("[notification-service] smtp error: %v — requeuing", err)
			d.Nack(false, true) // requeue for retry
			continue
		}

		d.Ack(false)
		log.Printf("[notification-service] sent %s → %s ✓", event.EventType, event.To)
	}

	log.Println("[notification-service] delivery channel closed, shutting down")
}
