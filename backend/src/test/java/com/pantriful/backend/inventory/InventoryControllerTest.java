package com.pantriful.backend.inventory;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pantriful.backend.auth.JwtService;
import com.pantriful.backend.user.User;
import com.pantriful.backend.user.UserRepository;
import java.math.BigDecimal;
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
class InventoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private InventoryItemRepository inventoryItemRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private String tokenFor(User user) {
        return jwtService.issueAccessToken(user.getId());
    }

    private User newUser(String email) {
        return userRepository.save(new User(email, "google", email));
    }

    @Test
    void create_thenList_returnsTheCreatedItem() throws Exception {
        User user = newUser("inventory-create@example.com");
        String body = objectMapper.writeValueAsString(
                new UpsertInventoryItemRequest("Eggs", new BigDecimal("12"), "count", "dairy", null, new BigDecimal("2")));

        mockMvc.perform(post("/inventory")
                        .header("Authorization", "Bearer " + tokenFor(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Eggs"))
                .andExpect(jsonPath("$.quantity").value(12));

        mockMvc.perform(get("/inventory").header("Authorization", "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Eggs"));
    }

    @Test
    void list_neverReturnsAnotherUsersItems() throws Exception {
        User userA = newUser("inventory-a@example.com");
        User userB = newUser("inventory-b@example.com");
        inventoryItemRepository.save(new InventoryItem(userA, "Milk", BigDecimal.ONE, "gallon"));
        inventoryItemRepository.save(new InventoryItem(userB, "Bread", BigDecimal.ONE, "loaf"));

        mockMvc.perform(get("/inventory").header("Authorization", "Bearer " + tokenFor(userA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Milk"));

        mockMvc.perform(get("/inventory").header("Authorization", "Bearer " + tokenFor(userB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Bread"));
    }

    @Test
    void update_cannotModifyAnotherUsersItem() throws Exception {
        User owner = newUser("inventory-owner-update@example.com");
        User attacker = newUser("inventory-attacker-update@example.com");
        InventoryItem item = inventoryItemRepository.save(new InventoryItem(owner, "Butter", BigDecimal.ONE, "block"));

        String body = objectMapper.writeValueAsString(
                new UpsertInventoryItemRequest("Hacked", BigDecimal.ZERO, "count", null, null, null));

        mockMvc.perform(put("/inventory/{id}", item.getId())
                        .header("Authorization", "Bearer " + tokenFor(attacker))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_cannotDeleteAnotherUsersItem() throws Exception {
        User owner = newUser("inventory-owner-delete@example.com");
        User attacker = newUser("inventory-attacker-delete@example.com");
        InventoryItem item = inventoryItemRepository.save(new InventoryItem(owner, "Cheese", BigDecimal.ONE, "block"));

        mockMvc.perform(delete("/inventory/{id}", item.getId())
                        .header("Authorization", "Bearer " + tokenFor(attacker)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/inventory").header("Authorization", "Bearer " + tokenFor(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void inventory_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/inventory")).andExpect(status().isUnauthorized());
    }
}
