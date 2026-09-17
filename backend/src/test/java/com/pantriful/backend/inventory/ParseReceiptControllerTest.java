package com.pantriful.backend.inventory;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pantriful.backend.auth.JwtService;
import com.pantriful.backend.user.User;
import com.pantriful.backend.user.UserRepository;
import java.util.List;
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
class ParseReceiptControllerTest {

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
    private ReceiptParsingService receiptParsingService;

    private String tokenFor(User user) {
        return jwtService.issueAccessToken(user.getId());
    }

    @Test
    void parseReceipt_returnsWhatTheServiceParses() throws Exception {
        User user = userRepository.save(new User("parse-receipt@example.com", "google", "parse-receipt-subject"));
        when(receiptParsingService.parse(any(), any()))
                .thenReturn(new ParsedReceipt(List.of(
                        new ParsedLineItem("Whole Milk", "dairy", 1.0, "gallon"),
                        new ParsedLineItem("Bananas", "produce", 6.0, "count"))));

        String body = objectMapper.writeValueAsString(new IdentifyPhotoRequest("dGVzdA==", "image/jpeg"));

        mockMvc.perform(post("/inventory/parse-receipt")
                        .header("Authorization", "Bearer " + tokenFor(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].name").value("Whole Milk"))
                .andExpect(jsonPath("$.items[1].name").value("Bananas"));
    }

    @Test
    void parseReceipt_requiresAuthentication() throws Exception {
        String body = objectMapper.writeValueAsString(new IdentifyPhotoRequest("dGVzdA==", "image/jpeg"));

        mockMvc.perform(post("/inventory/parse-receipt")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }
}
