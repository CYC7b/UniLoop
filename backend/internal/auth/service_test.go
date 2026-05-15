package auth

import "testing"

func TestIsSchoolEmail(t *testing.T) {
	tests := []struct {
		name  string
		email string
		want  bool
	}{
		{name: "student subdomain", email: "student@university.edu.my", want: true},
		{name: "case insensitive", email: "Student@UNIVERSITY.EDU.MY", want: true},
		{name: "trim space", email: " student@faculty.university.edu.my ", want: true},
		{name: "root domain rejected", email: "student@edu.my", want: false},
		{name: "lookalike domain rejected", email: "student@notedu.my", want: false},
		{name: "suffix attack rejected", email: "student@university.edu.my.evil.test", want: false},
		{name: "non school email rejected", email: "student@example.com", want: false},
		{name: "missing at rejected", email: "student.edu.my", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isSchoolEmail(tt.email); got != tt.want {
				t.Fatalf("isSchoolEmail(%q) = %v, want %v", tt.email, got, tt.want)
			}
		})
	}
}
