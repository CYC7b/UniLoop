package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const QueueEmailNotifications = "email.notifications"

// EventPublisher is implemented by any service that can publish email events.
// *Publisher satisfies this interface.
type EventPublisher interface {
	Publish(ctx context.Context, event EmailEvent) error
}

// EmailEvent is the JSON payload published to the queue.
type EmailEvent struct {
	EventType string `json:"event_type"` // "email.otp" | "email.welcome"
	To        string `json:"to"`
	Subject   string `json:"subject"`
	Body      string `json:"body"`
}

// Publisher holds an AMQP connection and channel for publishing messages.
type Publisher struct {
	conn    *amqp.Connection
	channel *amqp.Channel
}

// NewPublisher dials RabbitMQ with exponential backoff.
// Pass maxRetries=0 to retry indefinitely until success.
func NewPublisher(url string, maxRetries int) (*Publisher, error) {
	var conn *amqp.Connection
	var err error
	for i := 0; maxRetries == 0 || i < maxRetries; i++ {
		conn, err = amqp.Dial(url)
		if err == nil {
			break
		}
		secs := 1 << uint(i)
		if secs > 30 {
			secs = 30
		}
		wait := time.Duration(secs) * time.Second
		log.Printf("rabbitmq: dial failed (%v), retrying in %s", err, wait)
		time.Sleep(wait)
	}
	if err != nil {
		return nil, fmt.Errorf("rabbitmq connect: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("rabbitmq channel: %w", err)
	}

	if _, err = ch.QueueDeclare(QueueEmailNotifications, true, false, false, false, nil); err != nil {
		ch.Close()
		conn.Close()
		return nil, fmt.Errorf("rabbitmq declare queue: %w", err)
	}

	return &Publisher{conn: conn, channel: ch}, nil
}

// Publish marshals an EmailEvent and sends it to the email.notifications queue.
func (p *Publisher) Publish(ctx context.Context, event EmailEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return p.channel.PublishWithContext(ctx,
		"",
		QueueEmailNotifications,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
		},
	)
}

func (p *Publisher) Close() {
	p.channel.Close()
	p.conn.Close()
}

// Consumer wraps an AMQP connection for consuming messages.
type Consumer struct {
	conn    *amqp.Connection
	channel *amqp.Channel
}

// NewConsumer dials RabbitMQ with indefinite retry.
func NewConsumer(url string) (*Consumer, error) {
	var conn *amqp.Connection
	var err error
	for {
		conn, err = amqp.Dial(url)
		if err == nil {
			break
		}
		log.Printf("rabbitmq: consumer dial failed (%v), retrying in 5s", err)
		time.Sleep(5 * time.Second)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("rabbitmq channel: %w", err)
	}

	if _, err = ch.QueueDeclare(QueueEmailNotifications, true, false, false, false, nil); err != nil {
		ch.Close()
		conn.Close()
		return nil, fmt.Errorf("rabbitmq declare queue: %w", err)
	}

	// Process one email at a time (SMTP is slow; serializing is safe)
	_ = ch.Qos(1, 0, false)

	return &Consumer{conn: conn, channel: ch}, nil
}

// Consume returns a channel of AMQP deliveries.
func (c *Consumer) Consume() (<-chan amqp.Delivery, error) {
	return c.channel.Consume(
		QueueEmailNotifications,
		"",    // auto-generated consumer tag
		false, // manual ack
		false, false, false, nil,
	)
}

func (c *Consumer) Close() {
	c.channel.Close()
	c.conn.Close()
}
