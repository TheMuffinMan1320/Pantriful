package com.pantriful.backend.user;

import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class MeController {

    private final UserRepository userRepository;

    public MeController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        User user = findUser(jwt);
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName());
    }

    @PostMapping("/me/push-token")
    public void savePushToken(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PushTokenRequest request) {
        User user = findUser(jwt);
        user.setPushToken(request.pushToken());
        userRepository.save(user);
    }

    private User findUser(Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return userRepository
                .findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
