package com.pantriful.backend.inventory;

import jakarta.validation.constraints.NotBlank;

public record IdentifyPhotoRequest(@NotBlank String imageBase64, @NotBlank String mediaType) {}
