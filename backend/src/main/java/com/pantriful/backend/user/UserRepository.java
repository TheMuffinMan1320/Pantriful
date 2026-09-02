package com.pantriful.backend.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByOauthProviderAndOauthSubject(String oauthProvider, String oauthSubject);
}
