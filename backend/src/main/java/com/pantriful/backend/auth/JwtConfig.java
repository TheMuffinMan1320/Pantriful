package com.pantriful.backend.auth;

import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/**
 * A single shared HMAC secret key used to both sign (encode) and check (decode)
 * the JWTs Pantriful's own backend issues - separate from Google's keys, which are
 * only used to verify incoming Google Sign-In tokens (see GoogleIdTokenVerifier).
 *
 * Two decoders exist for the same key: "accessTokenDecoder" additionally requires
 * the "type" claim to be "access", so a refresh token (which shares the same
 * signing key) can never be used to call a normal protected endpoint - only
 * AuthController's /auth/refresh is allowed to accept refresh tokens, and it does
 * so via the more permissive "refreshTokenDecoder".
 */
@Configuration
public class JwtConfig {

    @Bean
    public SecretKey jwtSigningKey(@Value("${jwt.secret}") String secret) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "jwt.secret (JWT_SECRET env var) must be at least 32 bytes long for HS256");
        }
        return new SecretKeySpec(keyBytes, "HmacSHA256");
    }

    @Bean
    public JwtEncoder jwtEncoder(SecretKey jwtSigningKey) {
        return NimbusJwtEncoder.withSecretKey(jwtSigningKey).algorithm(MacAlgorithm.HS256).build();
    }

    @Bean
    public JwtDecoder accessTokenDecoder(SecretKey jwtSigningKey) {
        NimbusJwtDecoder decoder =
                NimbusJwtDecoder.withSecretKey(jwtSigningKey).macAlgorithm(MacAlgorithm.HS256).build();

        OAuth2TokenValidator<Jwt> requireAccessType = jwt -> {
            if (JwtService.ACCESS_TOKEN_TYPE.equals(jwt.getClaimAsString(JwtService.TOKEN_TYPE_CLAIM))) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error("invalid_token", "Token is not an access token", null));
        };

        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefault(), requireAccessType));
        return decoder;
    }

    @Bean
    public JwtDecoder refreshTokenDecoder(SecretKey jwtSigningKey) {
        return NimbusJwtDecoder.withSecretKey(jwtSigningKey).macAlgorithm(MacAlgorithm.HS256).build();
    }
}
