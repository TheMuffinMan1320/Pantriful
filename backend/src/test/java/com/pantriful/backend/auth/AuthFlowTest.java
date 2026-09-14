package com.pantriful.backend.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pantriful.backend.user.User;
import com.pantriful.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void googleLogin_rejectsInvalidIdToken() throws Exception {
        mockMvc.perform(post("/auth/oauth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("not-a-real-token"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_issuesNewTokenPair_andAccessTokenWorksOnProtectedEndpoint() throws Exception {
        User user = userRepository.save(new User("authflow-test@example.com", "google", "authflow-test-subject"));
        String refreshToken = jwtService.issueRefreshToken(user.getId());

        String responseBody = mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RefreshRequest(refreshToken))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andReturn()
                .getResponse()
                .getContentAsString();

        TokenPairResponse tokens = objectMapper.readValue(responseBody, TokenPairResponse.class);

        mockMvc.perform(get("/me").header("Authorization", "Bearer " + tokens.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("authflow-test@example.com"));
    }

    @Test
    void refreshToken_cannotBeUsedAsAccessToken() throws Exception {
        User user = userRepository.save(new User("authflow-test-2@example.com", "google", "authflow-test-subject-2"));
        String refreshToken = jwtService.issueRefreshToken(user.getId());

        mockMvc.perform(get("/me").header("Authorization", "Bearer " + refreshToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void me_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/me")).andExpect(status().isUnauthorized());
    }
}
