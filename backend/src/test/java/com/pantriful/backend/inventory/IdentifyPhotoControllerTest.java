package com.pantriful.backend.inventory;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pantriful.backend.auth.JwtService;
import com.pantriful.backend.user.User;
import com.pantriful.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class IdentifyPhotoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    // Mocked so tests never call the real Claude vision API - deterministic, free, no network dependency.
    @MockitoBean
    private PhotoIdentificationService photoIdentificationService;

    private String tokenFor(User user) {
        return jwtService.issueAccessToken(user.getId());
    }

    @Test
    void identifyPhoto_returnsWhatTheServiceIdentifies() throws Exception {
        User user = userRepository.save(new User("identify-photo@example.com", "google", "identify-photo-subject"));
        when(photoIdentificationService.identify(any(), any()))
                .thenReturn(new IdentifiedItem("Banana", "produce", 3.0, "count"));

        String body = objectMapper.writeValueAsString(new IdentifyPhotoRequest("dGVzdA==", "image/jpeg"));

        mockMvc.perform(post("/inventory/identify-photo")
                        .header("Authorization", "Bearer " + tokenFor(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Banana"))
                .andExpect(jsonPath("$.category").value("produce"))
                .andExpect(jsonPath("$.estimatedQuantity").value(3.0))
                .andExpect(jsonPath("$.unit").value("count"));
    }

    @Test
    void identifyPhoto_requiresAuthentication() throws Exception {
        String body = objectMapper.writeValueAsString(new IdentifyPhotoRequest("dGVzdA==", "image/jpeg"));

        mockMvc.perform(post("/inventory/identify-photo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }
}
