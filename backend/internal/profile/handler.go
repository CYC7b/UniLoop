package profile

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"uniloop/backend/internal/middleware"
	"uniloop/backend/internal/models"
	"uniloop/backend/internal/product"
	"uniloop/backend/internal/storage"
)

// Allowed image extensions for upload.
var allowedImageExts = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
}

var allowedImageContentTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

const maxUploadSize = 10 << 20 // 10 MB

type Handler struct {
	repo        *Repository
	productRepo *product.Repository
	storage     storage.Service
}

func NewHandler(repo *Repository, productRepo *product.Repository, store storage.Service) *Handler {
	return &Handler{repo: repo, productRepo: productRepo, storage: store}
}

// GetPublic returns a user's public profile + their active listings.
func (h *Handler) GetPublic(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	p, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	// Fix #5: only return active listings on public profile
	listings, _ := h.productRepo.GetByOwner(c.Request.Context(), id, true)
	if listings == nil {
		listings = []models.Product{}
	}
	c.JSON(http.StatusOK, gin.H{"profile": p, "listings": listings})
}

// UpdateMe updates name and school.
func (h *Handler) UpdateMe(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.repo.Update(c.Request.Context(), userID, req.Name, req.School); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	p, _ := h.repo.GetByID(c.Request.Context(), userID)
	c.JSON(http.StatusOK, p)
}

// UploadAvatar handles avatar image upload.
func (h *Handler) UploadAvatar(c *gin.Context) {
	userID := middleware.GetUserID(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)

	fh, err := c.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "avatar file required (max 10MB)"})
		return
	}

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if !allowedImageExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "allowed formats: jpg, jpeg, png, webp, gif"})
		return
	}
	ok, contentType, err := isAllowedImageContent(fh)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid avatar file"})
		return
	}
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "avatar content is not a supported image", "content_type": contentType})
		return
	}

	if err := h.storage.EnsureDirs(c.Request.Context(), "avatars"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "storage error"})
		return
	}

	// Use uuid to prevent cache issues when user re-uploads
	name := userID.String() + "_" + uuid.New().String()[:8] + ext
	url, err := h.storage.Save(c.Request.Context(), fh, "avatars", name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "write file"})
		return
	}

	if err := h.repo.UpdateAvatar(c.Request.Context(), userID, url); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"avatar_url": url})
}

// SubmitVerifyDoc marks status as pending (admin reviews uploaded doc externally).
func (h *Handler) SubmitVerifyDoc(c *gin.Context) {
	userID := middleware.GetUserID(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)

	fh, err := c.FormFile("document")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "document file required (max 10MB)"})
		return
	}

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	allowedDocExts := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".pdf": true, ".webp": true,
	}
	if !allowedDocExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "allowed formats: jpg, png, pdf, webp"})
		return
	}

	if err := h.storage.EnsureDirs(c.Request.Context(), "docs"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "storage error"})
		return
	}

	name := userID.String() + "_doc" + ext
	url, err := h.storage.Save(c.Request.Context(), fh, "docs", name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "write file"})
		return
	}

	if err := h.repo.SetVerificationDoc(c.Request.Context(), userID, url); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "submitted for review"})
}

func isAllowedImageContent(file *multipart.FileHeader) (bool, string, error) {
	src, err := file.Open()
	if err != nil {
		return false, "", err
	}
	defer src.Close()

	header := make([]byte, 512)
	n, err := src.Read(header)
	if err != nil && err != io.EOF {
		return false, "", err
	}

	contentType := detectImageContentType(header[:n])
	return allowedImageContentTypes[contentType], contentType, nil
}

func detectImageContentType(header []byte) string {
	if len(header) >= 12 && bytes.Equal(header[:4], []byte("RIFF")) && bytes.Equal(header[8:12], []byte("WEBP")) {
		return "image/webp"
	}
	return http.DetectContentType(header)
}
