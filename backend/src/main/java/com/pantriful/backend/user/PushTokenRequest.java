package com.pantriful.backend.user;

import jakarta.validation.constraints.NotBlank;

public record PushTokenRequest(@NotBlank String pushToken) {}
