package com.pantriful.backend.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pantriful.backend.auth.JwtService;
import com.pantriful.backend.catalog.IngredientCatalogRepository;
import com.pantriful.backend.catalog.OpenFoodFactsClient;
import com.pantriful.backend.user.User;
import com.pantriful.backend.user.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class LookupBarcodeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private IngredientCatalogRepository ingredientCatalogRepository;

    // Mocked so tests never call the real Open Food Facts API - deterministic, no network dependency.
    @MockitoBean
    private OpenFoodFactsClient openFoodFactsClient;

    private String tokenFor(User user) {
        return jwtService.issueAccessToken(user.getId());
    }

    @Test
    void lookup_cachesResultOnFirstCall_andNeverCallsApiAgainForTheSameBarcode() throws Exception {
        User user = userRepository.save(new User("lookup-barcode@example.com", "google", "lookup-barcode-subject"));
        when(openFoodFactsClient.lookup("0000000000001"))
                .thenReturn(Optional.of(new OpenFoodFactsClient.Product(
                        "Test Cereal", "Test Brand", new OpenFoodFactsClient.Nutriments(350.0, 70.0, 5.0, 8.0))));

        mockMvc.perform(get("/inventory/lookup-barcode/{barcode}", "0000000000001")
                        .header("Authorization", "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.found").value(true))
                .andExpect(jsonPath("$.name").value("Test Cereal"))
                .andExpect(jsonPath("$.brand").value("Test Brand"))
                .andExpect(jsonPath("$.caloriesPer100g").value(350.0));

        assertThat(ingredientCatalogRepository.findByBarcode("0000000000001")).isPresent();

        mockMvc.perform(get("/inventory/lookup-barcode/{barcode}", "0000000000001")
                        .header("Authorization", "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Test Cereal"));

        verify(openFoodFactsClient, times(1)).lookup("0000000000001");
    }

    @Test
    void lookup_returnsNotFound_whenProductDoesNotExist() throws Exception {
        User user = userRepository.save(new User("lookup-barcode-missing@example.com", "google", "lookup-missing"));
        when(openFoodFactsClient.lookup(any())).thenReturn(Optional.empty());

        mockMvc.perform(get("/inventory/lookup-barcode/{barcode}", "9999999999999")
                        .header("Authorization", "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.found").value(false));

        assertThat(ingredientCatalogRepository.findByBarcode("9999999999999")).isEmpty();
    }

    @Test
    void lookupBarcode_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/inventory/lookup-barcode/{barcode}", "0000000000001"))
                .andExpect(status().isUnauthorized());
        verify(openFoodFactsClient, never()).lookup(any());
    }
}
