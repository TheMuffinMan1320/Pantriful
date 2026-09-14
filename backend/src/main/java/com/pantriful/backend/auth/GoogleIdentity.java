package com.pantriful.backend.auth;

public record GoogleIdentity(String subject, String email, String name) {
}
