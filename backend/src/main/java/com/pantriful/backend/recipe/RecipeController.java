package com.pantriful.backend.recipe;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/recipes")
public class RecipeController {

    private final RecipeService recipeService;

    public RecipeController(RecipeService recipeService) {
        this.recipeService = recipeService;
    }

    @GetMapping
    public List<RecipeResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return recipeService.list(userId(jwt));
    }

    @GetMapping("/{id}")
    public RecipeResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return recipeService.get(userId(jwt), id);
    }

    @PostMapping("/generate")
    @ResponseStatus(HttpStatus.CREATED)
    public RecipeResponse generate(@AuthenticationPrincipal Jwt jwt) {
        return recipeService.generate(userId(jwt));
    }

    @PostMapping("/{id}/mark-made")
    public RecipeResponse markMade(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return recipeService.markMade(userId(jwt), id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        recipeService.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
