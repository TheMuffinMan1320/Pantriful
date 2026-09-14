package com.pantriful.backend.auth;

import com.pantriful.backend.user.User;
import com.pantriful.backend.user.UserRepository;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final GoogleIdTokenVerifier googleIdTokenVerifier;
    private final JwtService jwtService;
    private final JwtDecoder jwtDecoder;
    private final UserRepository userRepository;

    public AuthController(
            GoogleIdTokenVerifier googleIdTokenVerifier,
            JwtService jwtService,
            @Qualifier("refreshTokenDecoder") JwtDecoder jwtDecoder,
            UserRepository userRepository) {
        this.googleIdTokenVerifier = googleIdTokenVerifier;
        this.jwtService = jwtService;
        this.jwtDecoder = jwtDecoder;
        this.userRepository = userRepository;
    }

    @PostMapping("/oauth/google")
    public TokenPairResponse loginWithGoogle(@RequestBody @Valid GoogleLoginRequest request) {
        GoogleIdentity identity;
        try {
            identity = googleIdTokenVerifier.verify(request.idToken());
        } catch (JwtException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google ID token", e);
        }

        User user = userRepository
                .findByOauthProviderAndOauthSubject("google", identity.subject())
                .orElseGet(() -> userRepository.save(new User(identity.email(), "google", identity.subject())));

        if (user.getDisplayName() == null && identity.name() != null) {
            user.setDisplayName(identity.name());
            userRepository.save(user);
        }

        return issueTokenPair(user.getId());
    }

    @PostMapping("/refresh")
    public TokenPairResponse refresh(@RequestBody @Valid RefreshRequest request) {
        Jwt refreshJwt;
        try {
            refreshJwt = jwtDecoder.decode(request.refreshToken());
        } catch (JwtException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token", e);
        }

        if (!JwtService.REFRESH_TOKEN_TYPE.equals(refreshJwt.getClaimAsString(JwtService.TOKEN_TYPE_CLAIM))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token is not a refresh token");
        }

        UUID userId = UUID.fromString(refreshJwt.getSubject());
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unknown user");
        }

        return issueTokenPair(userId);
    }

    private TokenPairResponse issueTokenPair(UUID userId) {
        return new TokenPairResponse(jwtService.issueAccessToken(userId), jwtService.issueRefreshToken(userId));
    }
}
