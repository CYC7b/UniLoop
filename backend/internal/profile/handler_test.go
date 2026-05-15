package profile

import "testing"

func TestDetectImageContentType(t *testing.T) {
	tests := []struct {
		name   string
		header []byte
		want   string
	}{
		{name: "png", header: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, want: "image/png"},
		{name: "jpeg", header: []byte{0xff, 0xd8, 0xff, 0xdb}, want: "image/jpeg"},
		{name: "gif", header: []byte("GIF89a"), want: "image/gif"},
		{name: "webp", header: []byte{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'}, want: "image/webp"},
		{name: "text is not image", header: []byte("not really an image"), want: "text/plain; charset=utf-8"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := detectImageContentType(tt.header); got != tt.want {
				t.Fatalf("detectImageContentType() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestAllowedImageContentTypesRejectsText(t *testing.T) {
	contentType := detectImageContentType([]byte("not really an image"))
	if allowedImageContentTypes[contentType] {
		t.Fatalf("content type %q should not be allowed", contentType)
	}
}
