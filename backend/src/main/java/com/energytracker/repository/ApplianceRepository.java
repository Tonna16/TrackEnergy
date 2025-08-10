package com.energytracker.repository;

import java.time.LocalDateTime;
import java.util.List;

import com.energytracker.model.Appliance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ApplianceRepository extends JpaRepository<Appliance, Long> {
    boolean existsByIdAndUserId(Long applianceId, Long userId);

    boolean existsByName(String name); // For duplicate prevention

    List<Appliance> findByUserId(Long userId);
    List<Appliance> findAllByUserIdAndActiveTrue(Long userId);  // ✅ Only active

    // For guest appliances (no user associated)
    List<Appliance> findByUserIsNull();

    // ✅ For cleanup of soft-deleted appliances
    List<Appliance> findAllByActiveFalseAndUpdatedAtBefore(LocalDateTime threshold);
    List<Appliance> findAllByUserIdAndActiveTrueAndDeletedFalse(Long userId);

}
