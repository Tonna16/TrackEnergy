package com.energytracker.repository;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.model.EnergyUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface EnergyUsageLogRepository extends JpaRepository<EnergyUsageLog, Long> {

    /** Usage within a date range */
    @Query("""
        SELECT new com.energytracker.dto.EnergyUsageDTO(
            u.date,
            a.id,
            a.name,
            u.kWhUsed
        )
        FROM EnergyUsageLog u
        JOIN u.appliance a
        WHERE a.user.id = :userId
          AND u.date BETWEEN :start AND :end
        ORDER BY u.date ASC
    """)
    List<EnergyUsageDTO> findUsageBetween(Long userId, LocalDate start, LocalDate end);

    /** All usage for a user */
    @Query("""
        SELECT new com.energytracker.dto.EnergyUsageDTO(
            u.date,
            a.id,
            a.name,
            u.kWhUsed
        )
        FROM EnergyUsageLog u
        JOIN u.appliance a
        WHERE a.user.id = :userId
        ORDER BY u.date ASC
    """)
    List<EnergyUsageDTO> findUsageAll(Long userId);

    /** For duplicate checking */
    Optional<EnergyUsageLog> findByApplianceIdAndDate(Long applianceId, LocalDate date);

    /** All raw logs for summary */
    @Query("SELECT u FROM EnergyUsageLog u WHERE u.appliance.user.id = :userId")
    List<EnergyUsageLog> findAllByUserId(Long userId);

    /** Needed for dynamic averaging */
    List<EnergyUsageLog> findByApplianceIdAndDateBetween(
        Long applianceId, LocalDate startDate, LocalDate endDate
    );
}
