package com.pantriful.backend.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pantriful.backend.auth.JwtService;
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
class MeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private String tokenFor(User user) {
        return jwtService.issueAccessToken(user.getId());
    }

    @Test
    void savePushToken_persistsTokenOnTheCallingUser() throws Exception {
        User user = userRepository.save(new User("push-token@example.com", "google", "push-token-subject"));
        String body = objectMapper.writeValueAsString(new PushTokenRequest("ExponentPushToken[abc123]"));

        mockMvc.perform(post("/me/push-token")
                        .header("Authorization", "Bearer " + tokenFor(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getPushToken()).isEqualTo("ExponentPushToken[abc123]");
    }

    @Test
    void savePushToken_requiresAuthentication() throws Exception {
        String body = objectMapper.writeValueAsString(new PushTokenRequest("ExponentPushToken[abc123]"));

        mockMvc.perform(post("/me/push-token").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void me_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void me_returnsTheCallingUsersOwnProfile() throws Exception {
        User user = userRepository.save(new User("me-profile@example.com", "google", "me-profile-subject"));

        mockMvc.perform(get("/me").header("Authorization", "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("me-profile@example.com"));
    }
}
