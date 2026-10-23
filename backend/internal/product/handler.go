package product

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"uniloop/backend/internal/middleware"
	"uniloop/backend/internal/models"
	"uniloop/backend/internal/pagination"
	"uniloop/backend/internal/storage"
)

var allowedImageExts = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
}

var allowedImageContentTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

const maxUploadSize = 10 << 20 // 10 MB per file

type Handler struct {
	repo    *Repository
	storage storage.Service
}

func NewHandler(repo *Repository, store storage.Service) *Handler {
	return &Handler{repo: repo, storage: store}
}

func (h *Handler) List(c *gin.Context) {
	p := ListParams{
		Category:          c.Query("category"),
		ExcludeCategories: splitCSV(c.Query("exclude_categories")),
		Location:          c.Query("location"),
		Search:            c.Query("search"),
	}
	p.Limit, _ = strconv.Atoi(c.DefaultQuery("limit", "20"))
	cursor, err := pagination.Decode(c.Query("cursor"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p.Cursor = cursor

	if lat := c.Query("lat"); lat != "" {
		v, err := strconv.ParseFloat(lat, 64)
		if err == nil {
			p.UserLat = &v
		}
	}
	if lng := c.Query("lng"); lng != "" {
		v, err := strconv.ParseFloat(lng, 64)
		if err == nil {
			p.UserLng = &v
		}
	}
	if dist := c.Query("max_dist"); dist != "" {
		v, err := strconv.ParseFloat(dist, 64)
		if err == nil {
			p.MaxDist = &v
		}
	}

	page, err := h.repo.List(c.Request.Context(), p)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var next *string
	if page.NextCursor != "" {
		next = &page.NextCursor
	}
	c.JSON(http.StatusOK, gin.H{"data": page.Items, "next_cursor": next})
}

func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			values = append(values, part)
		}
	}
	return values
}

func (h *Handler) GetOne(c *gin.Context) {
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
	if p.Status != "active" {
		userID, hasUser := middleware.GetOptionalUserID(c)
		if !hasUser || (p.OwnerID != userID && !middleware.GetIsAdmin(c)) {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req models.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var idemKey *uuid.UUID
	if raw := c.GetHeader("Idempotency-Key"); raw != "" {
		key, err := uuid.Parse(raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Idempotency-Key must be a UUID"})
			return
		}
		idemKey = &key
	}
	p, replayed, err := h.repo.Create(c.Request.Context(), req, userID, idemKey)
	if errors.Is(err, ErrUnknownImages) {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if replayed {
		c.Header("Idempotent-Replayed", "true")
		c.JSON(http.StatusOK, p)
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *Handler) Update(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	ownerID, err := h.repo.GetOwner(c.Request.Context(), id)
	if err != nil || ownerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	var req models.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p, err := h.repo.Update(c.Request.Context(), id, userID, req)
	if errors.Is(err, ErrUnknownImages) {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) Delete(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	ownerID, err := h.repo.GetOwner(c.Request.Context(), id)
	if err != nil || ownerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// Locations returns distinct location names from active products.
func (h *Handler) Locations(c *gin.Context) {
	p := LocationParams{
		Category:          c.Query("category"),
		ExcludeCategories: splitCSV(c.Query("exclude_categories")),
	}
	locs, err := h.repo.ListLocations(c.Request.Context(), p)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if locs == nil {
		locs = []string{}
	}
	c.JSON(http.StatusOK, gin.H{"locations": locs})
}

// UploadImages handles multipart image uploads, returns public URLs.
// Accepts "images" (product images) and optional "thumbnails" (thumb versions).
// All files are validated before any is written; if saving or recording any
// of them fails, the files already written are removed. Saved files are
// registered as unclaimed uploads until a listing claims them.
func (h *Handler) UploadImages(c *gin.Context) {
	userID := middleware.GetUserID(c)
	// Limit total body: 9 images + 9 thumbnails
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 18*maxUploadSize)

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid multipart form or body too large"})
		return
	}
	files := form.File["images"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no images provided"})
		return
	}
	thumbFiles := form.File["thumbnails"]
	if len(files) > 9 || len(thumbFiles) > 9 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "max 9 images"})
		return
	}

	type pendingFile struct {
		fh  *multipart.FileHeader
		dir string
		ext string
	}
	var pending []pendingFile
	for _, group := range []struct {
		files []*multipart.FileHeader
		dir   string
	}{{files, "products"}, {thumbFiles, "thumbnails"}} {
		for _, fh := range group.files {
			ext, err := validateImage(fh)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			pending = append(pending, pendingFile{fh: fh, dir: group.dir, ext: ext})
		}
	}

	saved := make([]string, 0, len(pending))
	// Use a fresh context: a cancelled request is a common reason to roll back.
	rollback := func() {
		for _, url := range saved {
			if err := h.storage.Delete(context.Background(), url); err != nil {
				log.Printf("upload rollback: %v", err)
			}
		}
	}
	for _, p := range pending {
		url, err := h.storage.Save(c.Request.Context(), p.fh, p.dir, uuid.New().String()+p.ext)
		if err != nil {
			rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "storage error"})
			return
		}
		saved = append(saved, url)
	}
	if err := h.repo.RecordUploads(c.Request.Context(), userID, saved); err != nil {
		rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "storage error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"urls": saved[:len(files)], "thumbnails": saved[len(files):]})
}

func validateImage(fh *multipart.FileHeader) (string, error) {
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if !allowedImageExts[ext] {
		return "", fmt.Errorf("allowed formats: jpg, jpeg, png, webp, gif")
	}
	if fh.Size > maxUploadSize {
		return "", fmt.Errorf("each file must be under 10MB")
	}
	ok, contentType, err := isAllowedImageContent(fh)
	if err != nil {
		return "", fmt.Errorf("invalid image file")
	}
	if !ok {
		return "", fmt.Errorf("image content is not supported: %s", contentType)
	}
	return ext, nil
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
