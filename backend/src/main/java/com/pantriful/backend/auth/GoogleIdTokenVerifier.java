package com.pantriful.backend.auth;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;

/**
 * Verifies Google Sign-In ID tokens: checks the signature against Google's public
 * keys, that Google issued it, and that it was issued for one of our own OAuth
 * client IDs (not some other app's).
 */
@Service
public class GoogleIdTokenVerifier {

    private static final String GOOGLE_JWK_SET_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final String GOOGLE_ISSUER = "https://accounts.google.com";

    private final NimbusJwtDecoder googleJwtDecoder;

    public GoogleIdTokenVerifier(
            @Value("${google.oauth.web-client-id}") String webClientId,
            @Value("${google.oauth.ios-client-id}") String iosClientId) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(GOOGLE_JWK_SET_URI).build();

        OAuth2TokenValidator<Jwt> issuerValidator = new JwtIssuerValidator(GOOGLE_ISSUER);
        OAuth2TokenValidator<Jwt> audienceValidator = jwt -> {
            List<String> audience = jwt.getAudience();
            if (audience != null && (audience.contains(webClientId) || audience.contains(iosClientId))) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error("invalid_token", "Token audience does not match Pantriful's OAuth client IDs", null));
        };

        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefault(), issuerValidator, audienceValidator));

        this.googleJwtDecoder = decoder;
    }

    /**
     * @throws JwtValidationException if the token is malformed, expired, not from
     *      Google, or not addressed to this app.
     */
    public GoogleIdentity verify(String idToken) {
        Jwt jwt = googleJwtDecoder.decode(idToken);
        return new GoogleIdentity(jwt.getSubject(), jwt.getClaimAsString("email"), jwt.getClaimAsString("name"));
    }
}
