package com.energytracker.repository;

import java.util.List;
import com.energytracker.model.Appliance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ApplianceRepository extends JpaRepository<Appliance, Long> {
    boolean existsByIdAndUserId(Long applianceId, Long userId);

    boolean existsByName(String name); // For duplicate prevention

    List<Appliance> findByUserId(Long userId);
    List<Appliance> findAllByUserIdAndActiveTrue(Long userId);  // ✅ ADD THIS

    // For guest appliances (no user associated)
    List<Appliance> findByUserIsNull();
}
