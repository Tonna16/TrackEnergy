package com.energytracker.repository;

import com.energytracker.model.RefreshTokenSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RefreshTokenSessionRepository extends JpaRepository<RefreshTokenSession, Long> {
    Optional<RefreshTokenSession> findByTokenId(String tokenId);

    List<RefreshTokenSession> findByFamilyId(String familyId);
}
