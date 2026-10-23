package models

import (
	"testing"

	"github.com/gin-gonic/gin/binding"
	"github.com/google/uuid"
)

func ptr[T any](v T) *T { return &v }

func TestCreateProductPriceValidation(t *testing.T) {
	tests := []struct {
		name  string
		price *float64
		ok    bool
	}{
		{name: "missing", price: nil, ok: false},
		{name: "zero is a free listing", price: ptr(0.0), ok: true},
		{name: "one cent", price: ptr(0.01), ok: true},
		{name: "negative", price: ptr(-5.0), ok: false},
		{name: "largest NUMERIC(10,2)", price: ptr(99999999.99), ok: true},
		{name: "overflows NUMERIC(10,2)", price: ptr(100000000.0), ok: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := CreateProductRequest{
				Title: "lamp", Price: tt.price, Images: []string{"/uploads/products/a.png"},
				Category: "electronics", LocationName: "KK12",
			}
			if err := binding.Validator.ValidateStruct(&req); (err == nil) != tt.ok {
				t.Fatalf("ValidateStruct err = %v, want ok=%v", err, tt.ok)
			}
		})
	}
}

func TestUpdateProductPriceValidation(t *testing.T) {
	tests := []struct {
		name  string
		price *float64
		ok    bool
	}{
		{name: "not provided", price: nil, ok: true},
		{name: "zero", price: ptr(0.0), ok: true},
		{name: "negative", price: ptr(-0.01), ok: false},
		{name: "overflow", price: ptr(100000000.0), ok: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := UpdateProductRequest{Price: tt.price}
			if err := binding.Validator.ValidateStruct(&req); (err == nil) != tt.ok {
				t.Fatalf("ValidateStruct err = %v, want ok=%v", err, tt.ok)
			}
		})
	}
}

func TestCreateReportTargetTypeValidation(t *testing.T) {
	tests := []struct {
		targetType string
		ok         bool
	}{
		{"product", true},
		{"user", true},
		{"conversation", true},
		{"comment", false},
		{"Product", false},
		{"", false},
	}
	for _, tt := range tests {
		t.Run(tt.targetType, func(t *testing.T) {
			req := CreateReportRequest{TargetType: tt.targetType, TargetID: uuid.New()}
			if err := binding.Validator.ValidateStruct(&req); (err == nil) != tt.ok {
				t.Fatalf("ValidateStruct err = %v, want ok=%v", err, tt.ok)
			}
		})
	}
}
