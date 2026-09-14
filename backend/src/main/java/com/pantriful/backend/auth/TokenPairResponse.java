package com.pantriful.backend.auth;

public record TokenPairResponse(String accessToken, String refreshToken) {
}
