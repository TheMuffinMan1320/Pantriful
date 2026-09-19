package com.pantriful.backend.notification;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

// Sends push notifications via Expo's push API - no credentials needed (unlike raw APNs/FCM),
// since Expo's own service relays to the device using the token's embedded project info.
// See https://docs.expo.dev/push-notifications/sending-notifications/
@Component
public class ExpoPushClient {

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper;

    public ExpoPushClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void send(String pushToken, String title, String body) {
        try {
            String json = objectMapper.writeValueAsString(new PushMessage(pushToken, title, body));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://exp.host/--/api/v2/push/send"))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            httpClient.send(request, HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            // A failed push (bad token, network hiccup, Expo outage) must never fail the
            // caller's request - the inventory/recipe write it's attached to already succeeded.
        }
    }

    record PushMessage(String to, String title, String body) {}
}
