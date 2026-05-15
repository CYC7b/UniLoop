package favorite

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"uniloop/backend/internal/middleware"
	"uniloop/backend/internal/models"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	items, ids, err := h.service.List(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = []models.Product{}
	}
	if ids == nil {
		ids = []uuid.UUID{}
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "ids": ids})
}

func (h *Handler) Add(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req models.AddFavoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.service.Add(c.Request.Context(), userID, req.ProductID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "added"})
}

func (h *Handler) Remove(c *gin.Context) {
	userID := middleware.GetUserID(c)
	productID, err := uuid.Parse(c.Param("productId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.service.Remove(c.Request.Context(), userID, productID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) GetIDs(c *gin.Context) {
	userID := middleware.GetUserID(c)
	ids, err := h.service.ListIDs(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if ids == nil {
		ids = []uuid.UUID{}
	}
	c.JSON(http.StatusOK, gin.H{"ids": ids})
}
