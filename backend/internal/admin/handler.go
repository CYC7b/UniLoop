package admin

import (
	"fmt"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db   *pgxpool.Pool
	repo *Repository
	// uploadRoot is the absolute path where uploads are stored (e.g. /app/uploads).
	uploadRoot string
}

func NewHandler(repo *Repository, uploadRoot string) *Handler {
	return &Handler{db: repo.db, repo: repo, uploadRoot: uploadRoot}
}

// Stats returns dashboard statistics.
func (h *Handler) Stats(c *gin.Context) {
	c.JSON(http.StatusOK, h.repo.Stats(c.Request.Context()))
}

// ListUsers returns paginated user list with search and filter.
func (h *Handler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")
	verification := c.Query("verification")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	where := []string{"1=1"}
	args := []any{}
	n := 1

	if search != "" {
		where = append(where, fmt.Sprintf("(p.full_name ILIKE $%d OR p.email ILIKE $%d)", n, n))
		args = append(args, "%"+search+"%")
		n++
	}
	if verification != "" {
		where = append(where, fmt.Sprintf("p.verification_status = $%d", n))
		args = append(args, verification)
		n++
	}

	whereStr := strings.Join(where, " AND ")

	var total int
	_ = h.db.QueryRow(c.Request.Context(),
		fmt.Sprintf("SELECT COUNT(*) FROM profiles p WHERE %s", whereStr), args...).Scan(&total)

	args = append(args, limit, offset)
	query := fmt.Sprintf(`
		SELECT p.id, p.email, p.full_name, p.school, p.avatar_url,
		       p.verification_status, COALESCE(p.verification_doc_url, ''),
		       p.created_at, COALESCE(u.is_admin, FALSE),
		       (SELECT COUNT(*) FROM products WHERE owner_id = p.id)
		FROM profiles p
		JOIN users u ON u.id = p.id
		WHERE %s
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d`, whereStr, n, n+1)

	rows, err := h.db.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type userRow struct {
		ID                 uuid.UUID `json:"id"`
		Email              string    `json:"email"`
		FullName           string    `json:"full_name"`
		School             string    `json:"school"`
		AvatarURL          string    `json:"avatar_url"`
		VerificationStatus string    `json:"verification_status"`
		VerificationDocURL string    `json:"verification_doc_url"`
		CreatedAt          time.Time `json:"created_at"`
		IsAdmin            bool      `json:"is_admin"`
		ProductCount       int       `json:"product_count"`
	}

	var users []userRow
	for rows.Next() {
		var u userRow
		if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.School, &u.AvatarURL,
			&u.VerificationStatus, &u.VerificationDocURL, &u.CreatedAt, &u.IsAdmin, &u.ProductCount); err != nil {
			continue
		}
		users = append(users, u)
	}
	if users == nil {
		users = []userRow{}
	}

	c.JSON(http.StatusOK, gin.H{"data": users, "total": total, "page": page, "limit": limit})
}

// UpdateUserVerification changes a user's verification status.
func (h *Handler) UpdateUserVerification(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	valid := map[string]bool{"unverified": true, "pending": true, "verified": true}
	if !valid[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status must be unverified, pending, or verified"})
		return
	}
	if err := h.repo.UpdateUserVerification(c.Request.Context(), id, req.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// DeleteUser deletes a user and all related data (cascading).
func (h *Handler) DeleteUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.repo.DeleteUser(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// GetVerificationDoc streams the user's verification document to admins.
func (h *Handler) GetVerificationDoc(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	ctx := c.Request.Context()
	if c.Query("list") == "1" {
		docs, listErr := listVerificationDocs(h.uploadRoot, id.String())
		if listErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "document not found"})
			return
		}
		primary := ""
		if docURL, urlErr := h.repo.GetVerificationDocURL(ctx, id); urlErr == nil && docURL != "" {
			if _, name, resolveErr := resolveDocPath(h.uploadRoot, docURL); resolveErr == nil {
				primary = name
			}
		}
		if primary == "" && len(docs) > 0 {
			primary = docs[0].Name
		}
		c.JSON(http.StatusOK, gin.H{"docs": docs, "primary": primary})
		return
	}

	if fileParam := strings.TrimSpace(c.Query("file")); fileParam != "" {
		fileName := path.Base(fileParam)
		if !strings.HasPrefix(fileName, id.String()+"_doc.") {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
		filePath := filepath.Join(h.uploadRoot, "docs", fileName)
		if stat, statErr := os.Stat(filePath); statErr != nil || stat.IsDir() {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Header("Cache-Control", "private, no-store")
		c.File(filePath)
		return
	}

	docURL, err := h.repo.GetVerificationDocURL(ctx, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}

	var filePath, filename string
	if docURL != "" {
		if resolvedPath, resolvedName, resolveErr := resolveDocPath(h.uploadRoot, docURL); resolveErr == nil {
			if stat, statErr := os.Stat(resolvedPath); statErr == nil && !stat.IsDir() {
				filePath = resolvedPath
				filename = resolvedName
			}
		}
	}
	if filePath == "" {
		if legacyPath, legacyName, ok := findLegacyDocPath(h.uploadRoot, id.String()); ok {
			filePath = legacyPath
			filename = legacyName
			_ = h.repo.SetVerificationDocURL(ctx, id, "/uploads/docs/"+legacyName)
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
	}

	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Header("Cache-Control", "private, no-store")
	c.File(filePath)
}

type verificationDoc struct {
	Name        string `json:"name"`
	ContentType string `json:"content_type"`
}

func listVerificationDocs(uploadRoot, userID string) ([]verificationDoc, error) {
	pattern := filepath.Join(uploadRoot, "docs", userID+"_doc.*")
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return nil, err
	}
	sort.Strings(matches)
	docs := make([]verificationDoc, 0, len(matches))
	for _, filePath := range matches {
		name := filepath.Base(filePath)
		ext := strings.ToLower(filepath.Ext(name))
		contentType := mime.TypeByExtension(ext)
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		docs = append(docs, verificationDoc{Name: name, ContentType: contentType})
	}
	return docs, nil
}

func resolveDocPath(uploadRoot, docURL string) (string, string, error) {
	cleanURL := strings.TrimSpace(docURL)
	if cleanURL == "" {
		return "", "", fmt.Errorf("empty doc url")
	}
	if strings.HasPrefix(cleanURL, "http://") || strings.HasPrefix(cleanURL, "https://") {
		parsed, err := url.Parse(cleanURL)
		if err != nil {
			return "", "", fmt.Errorf("invalid doc url")
		}
		cleanURL = parsed.Path
	}
	if strings.HasPrefix(cleanURL, "uploads/") {
		cleanURL = "/" + cleanURL
	}
	if !strings.HasPrefix(cleanURL, "/uploads/") {
		return "", "", fmt.Errorf("invalid doc url")
	}
	rel := strings.TrimPrefix(cleanURL, "/uploads/")
	if !strings.HasPrefix(rel, "docs/") {
		return "", "", fmt.Errorf("invalid doc path")
	}
	rel = path.Clean(rel)
	if strings.HasPrefix(rel, "..") || !strings.HasPrefix(rel, "docs/") {
		return "", "", fmt.Errorf("invalid doc path")
	}
	filename := path.Base(rel)
	return filepath.Join(uploadRoot, filepath.FromSlash(rel)), filename, nil
}

func findLegacyDocPath(uploadRoot, userID string) (string, string, bool) {
	pattern := filepath.Join(uploadRoot, "docs", userID+"_doc.*")
	matches, err := filepath.Glob(pattern)
	if err != nil || len(matches) == 0 {
		return "", "", false
	}
	filePath := matches[0]
	return filePath, filepath.Base(filePath), true
}

// ListProducts returns paginated product list with search and filters.
func (h *Handler) ListProducts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")
	status := c.Query("status")
	category := c.Query("category")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	where := []string{"1=1"}
	args := []any{}
	n := 1

	if search != "" {
		where = append(where, fmt.Sprintf(
			"(p.title ILIKE $%d OR p.description ILIKE $%d OR pr.email ILIKE $%d)", n, n, n))
		args = append(args, "%"+search+"%")
		n++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("p.status = $%d", n))
		args = append(args, status)
		n++
	}
	if category != "" {
		where = append(where, fmt.Sprintf("p.category = $%d", n))
		args = append(args, category)
		n++
	}

	whereStr := strings.Join(where, " AND ")

	var total int
	_ = h.db.QueryRow(c.Request.Context(),
		fmt.Sprintf("SELECT COUNT(*) FROM products p LEFT JOIN profiles pr ON pr.id = p.owner_id WHERE %s", whereStr), args...).Scan(&total)

	args = append(args, limit, offset)
	query := fmt.Sprintf(`
		SELECT p.id, p.title, p.price, p.currency, p.images, p.category,
		       p.status, p.owner_id, COALESCE(pr.full_name,''), COALESCE(pr.email,''), p.created_at
		FROM products p
		LEFT JOIN profiles pr ON pr.id = p.owner_id
		WHERE %s
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d`, whereStr, n, n+1)

	rows, err := h.db.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type productRow struct {
		ID         uuid.UUID `json:"id"`
		Title      string    `json:"title"`
		Price      float64   `json:"price"`
		Currency   string    `json:"currency"`
		Images     []string  `json:"images"`
		Category   string    `json:"category"`
		Status     string    `json:"status"`
		OwnerID    uuid.UUID `json:"owner_id"`
		OwnerName  string    `json:"owner_name"`
		OwnerEmail string    `json:"owner_email"`
		CreatedAt  time.Time `json:"created_at"`
	}

	var products []productRow
	for rows.Next() {
		var p productRow
		if err := rows.Scan(&p.ID, &p.Title, &p.Price, &p.Currency, &p.Images, &p.Category,
			&p.Status, &p.OwnerID, &p.OwnerName, &p.OwnerEmail, &p.CreatedAt); err != nil {
			continue
		}
		if p.Images == nil {
			p.Images = []string{}
		}
		products = append(products, p)
	}
	if products == nil {
		products = []productRow{}
	}

	c.JSON(http.StatusOK, gin.H{"data": products, "total": total, "page": page, "limit": limit})
}

// UpdateProductStatus changes a product's status.
func (h *Handler) UpdateProductStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	valid := map[string]bool{"active": true, "sold": true, "removed": true}
	if !valid[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status must be active, sold, or removed"})
		return
	}
	if err := h.repo.UpdateProductStatus(c.Request.Context(), id, req.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// DeleteProduct permanently deletes a product.
func (h *Handler) DeleteProduct(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.repo.DeleteProduct(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ListReports returns paginated report list.
func (h *Handler) ListReports(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	resolved := c.Query("resolved")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	where := []string{"1=1"}
	args := []any{}
	n := 1

	if resolved == "true" {
		where = append(where, "r.resolved = TRUE")
	} else if resolved == "false" {
		where = append(where, "r.resolved = FALSE")
	}

	whereStr := strings.Join(where, " AND ")

	var total int
	_ = h.db.QueryRow(c.Request.Context(),
		fmt.Sprintf("SELECT COUNT(*) FROM reports r WHERE %s", whereStr), args...).Scan(&total)

	args = append(args, limit, offset)
	query := fmt.Sprintf(`
		SELECT r.id, r.reporter_id, COALESCE(pr.full_name,''), r.target_type, r.target_id,
		       r.reason, r.resolved, r.created_at
		FROM reports r
		LEFT JOIN profiles pr ON pr.id = r.reporter_id
		WHERE %s
		ORDER BY r.created_at DESC
		LIMIT $%d OFFSET $%d`, whereStr, n, n+1)

	rows, err := h.db.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type reportRow struct {
		ID           uuid.UUID `json:"id"`
		ReporterID   uuid.UUID `json:"reporter_id"`
		ReporterName string    `json:"reporter_name"`
		TargetType   string    `json:"target_type"`
		TargetID     uuid.UUID `json:"target_id"`
		Reason       string    `json:"reason"`
		Resolved     bool      `json:"resolved"`
		CreatedAt    time.Time `json:"created_at"`
	}

	var reports []reportRow
	for rows.Next() {
		var r reportRow
		if err := rows.Scan(&r.ID, &r.ReporterID, &r.ReporterName, &r.TargetType, &r.TargetID,
			&r.Reason, &r.Resolved, &r.CreatedAt); err != nil {
			continue
		}
		reports = append(reports, r)
	}
	if reports == nil {
		reports = []reportRow{}
	}

	c.JSON(http.StatusOK, gin.H{"data": reports, "total": total, "page": page, "limit": limit})
}

// ResolveReport marks a report as resolved.
func (h *Handler) ResolveReport(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.repo.ResolveReport(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "resolved"})
}

// DeleteReport permanently deletes a report.
func (h *Handler) DeleteReport(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.repo.DeleteReport(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
