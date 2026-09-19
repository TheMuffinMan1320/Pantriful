package com.pantriful.backend.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pantriful.backend.auth.JwtService;
import com.pantriful.backend.inventory.InventoryItem;
import com.pantriful.backend.inventory.InventoryItemRepository;
import com.pantriful.backend.inventory.UpsertInventoryItemRequest;
import com.pantriful.backend.user.User;
import com.pantriful.backend.user.UserRepository;
import java.math.BigDecimal;
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
class LowStockNotificationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private InventoryItemRepository inventoryItemRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private ObjectMapper objectMapper;

    // Mocked so tests never make a real network call to Expo's push API.
    @MockitoBean
    private ExpoPushClient expoPushClient;

    private User newUser(String email) {
        User user = new User(email, "google", email);
        user.setPushToken(PUSH_TOKEN);
        return userRepository.save(user);
    }

    private void updateItem(User user, InventoryItem item, String quantity) throws Exception {
        String body = objectMapper.writeValueAsString(
                new UpsertInventoryItemRequest(
                        item.getName(), new BigDecimal(quantity), item.getUnit(), null, null, item.getLowStockThreshold()));
        mockMvc.perform(put("/inventory/{id}", item.getId())
                        .header("Authorization", "Bearer " + jwtService.issueAccessToken(user.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
    }

    @Test
    void droppingBelowThreshold_sendsExactlyOnePush_andLogsOneNotification() throws Exception {
        User user = newUser("low-stock@example.com");
        InventoryItem item = inventoryItemRepository.save(new InventoryItem(user, "Milk", new BigDecimal("3"), "gallon"));
        item.setLowStockThreshold(new BigDecimal("1"));
        inventoryItemRepository.save(item);

        long notificationsBefore = notificationRepository.count();

        updateItem(user, item, "0.5"); // drops below threshold

        verify(expoPushClient, times(1)).send(eq(PUSH_TOKEN), any(), any());
        assertThat(notificationRepository.count()).isEqualTo(notificationsBefore + 1);
    }

    @Test
    void repeatedLowUpdates_doNotSendDuplicatePushes() throws Exception {
        User user = newUser("low-stock-dedupe@example.com");
        InventoryItem item = inventoryItemRepository.save(new InventoryItem(user, "Eggs", new BigDecimal("3"), "count"));
        item.setLowStockThreshold(new BigDecimal("2"));
        inventoryItemRepository.save(item);

        updateItem(user, item, "1"); // first drop below threshold - notifies
        updateItem(user, item, "0.5"); // still below threshold - should NOT notify again

        verify(expoPushClient, times(1)).send(eq(PUSH_TOKEN), any(), any());
    }

    @Test
    void risingAboveThenDroppingAgain_sendsASecondPush() throws Exception {
        User user = newUser("low-stock-reset@example.com");
        InventoryItem item = inventoryItemRepository.save(new InventoryItem(user, "Bread", new BigDecimal("3"), "loaf"));
        item.setLowStockThreshold(new BigDecimal("1"));
        inventoryItemRepository.save(item);

        updateItem(user, item, "0.5"); // drop below - notifies (1st)
        updateItem(user, item, "5"); // back above threshold - resets
        updateItem(user, item, "0.5"); // drop below again - notifies (2nd)

        verify(expoPushClient, times(2)).send(eq(PUSH_TOKEN), any(), any());
    }

    private static final String PUSH_TOKEN = "ExponentPushToken[test-token]";
}
