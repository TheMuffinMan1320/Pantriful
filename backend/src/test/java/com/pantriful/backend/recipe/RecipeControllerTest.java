package com.pantriful.backend.recipe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pantriful.backend.auth.JwtService;
import com.pantriful.backend.inventory.InventoryItem;
import com.pantriful.backend.inventory.InventoryItemRepository;
import com.pantriful.backend.user.User;
import com.pantriful.backend.user.UserRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RecipeControllerTest {

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

    // Mocked so tests never call the real Claude API - deterministic, free, and no network dependency.
    @MockitoBean
    private RecipeGenerationService recipeGenerationService;

    private String tokenFor(User user) {
        return jwtService.issueAccessToken(user.getId());
    }

    private User newUser(String email) {
        return userRepository.save(new User(email, "google", email));
    }

    private RecipeResponse generateRecipe(User user, GeneratedRecipe generated) throws Exception {
        when(recipeGenerationService.generate(any())).thenReturn(generated);
        String body = mockMvc.perform(post("/recipes/generate").header("Authorization", "Bearer " + tokenFor(user)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readValue(body, RecipeResponse.class);
    }

    @Test
    void generate_persistsMatchedAndUnmatchedIngredients_andListReturnsIt() throws Exception {
        User user = newUser("recipe-generate@example.com");
        InventoryItem flour =
                inventoryItemRepository.save(new InventoryItem(user, "Flour", new BigDecimal("2"), "cups"));

        RecipeResponse created = generateRecipe(
                user,
                new GeneratedRecipe(
                        "Pancakes",
                        4,
                        "1. Mix. 2. Cook.",
                        List.of(
                                new GeneratedRecipe.GeneratedIngredient(
                                        flour.getId().toString(), "Flour", 1.5, "cups"),
                                new GeneratedRecipe.GeneratedIngredient(null, "Salt", 0.25, "tsp")),
                        new GeneratedRecipe.GeneratedNutrition(210.0, 6.0, 30.0, 5.0)));

        assertThat(created.title()).isEqualTo("Pancakes");
        assertThat(created.ingredients()).hasSize(2);
        assertThat(created.ingredients().get(0).inventoryItemId()).isEqualTo(flour.getId());
        assertThat(created.ingredients().get(1).inventoryItemId()).isNull();
        assertThat(created.nutrition().caloriesPerServing()).isEqualByComparingTo("210.0");

        mockMvc.perform(get("/recipes").header("Authorization", "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Pancakes"));
    }

    @Test
    void generate_onlySendsTheCallingUsersOwnInventoryToClaude() throws Exception {
        User userA = newUser("recipe-a@example.com");
        User userB = newUser("recipe-b@example.com");
        inventoryItemRepository.save(new InventoryItem(userA, "Rice", BigDecimal.ONE, "cup"));
        inventoryItemRepository.save(new InventoryItem(userB, "Beans", BigDecimal.ONE, "cup"));

        generateRecipe(userA, new GeneratedRecipe("Rice bowl", 1, "Cook rice.", List.of(), null));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<InventoryItem>> pantryCaptor = ArgumentCaptor.forClass(List.class);
        verify(recipeGenerationService).generate(pantryCaptor.capture());
        assertThat(pantryCaptor.getValue()).hasSize(1);
        assertThat(pantryCaptor.getValue().get(0).getName()).isEqualTo("Rice");
    }

    @Test
    void markMade_decrementsMatchedIngredient_neverBelowZero_andSkipsUntrackedStaples() throws Exception {
        User user = newUser("recipe-mark-made@example.com");
        InventoryItem eggs =
                inventoryItemRepository.save(new InventoryItem(user, "Eggs", new BigDecimal("2"), "count"));

        RecipeResponse created = generateRecipe(
                user,
                new GeneratedRecipe(
                        "Omelette",
                        1,
                        "Cook eggs.",
                        List.of(
                                new GeneratedRecipe.GeneratedIngredient(
                                        eggs.getId().toString(), "Eggs", 5, "count"),
                                new GeneratedRecipe.GeneratedIngredient(null, "Salt", 1, "pinch")),
                        null));

        mockMvc.perform(post("/recipes/{id}/mark-made", created.id()).header("Authorization", "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("made"));

        InventoryItem updated = inventoryItemRepository.findById(eggs.getId()).orElseThrow();
        assertThat(updated.getQuantity()).isEqualByComparingTo("0"); // 2 - 5, clamped at 0, never negative
    }

    @Test
    void markMade_cannotMarkAnotherUsersRecipeAsMade() throws Exception {
        User owner = newUser("recipe-owner-mark@example.com");
        User attacker = newUser("recipe-attacker-mark@example.com");

        RecipeResponse recipe = generateRecipe(owner, new GeneratedRecipe("Toast", 1, "Toast bread.", List.of(), null));

        mockMvc.perform(post("/recipes/{id}/mark-made", recipe.id())
                        .header("Authorization", "Bearer " + tokenFor(attacker)))
                .andExpect(status().isNotFound());
    }

    @Test
    void recipes_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/recipes")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/recipes/generate")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/recipes/{id}/mark-made", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }
}
