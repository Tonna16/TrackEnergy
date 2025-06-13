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

    /**
     * Return a list of EnergyUsageDTO for a given userId,
     * optionally filtered by startDate and/or endDate.
     */
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
          AND (:startDate IS NULL OR u.date >= :startDate)
          AND (:endDate   IS NULL OR u.date <= :endDate)
        ORDER BY u.date ASC
    """)
    List<EnergyUsageDTO> findUsageByUserId(
        Long userId,
        LocalDate startDate,
        LocalDate endDate
    );

    /**
     * Prevent duplicates: check if an entry already exists for this appliance + date.
     */
    Optional<EnergyUsageLog> findByApplianceIdAndDate(Long applianceId, LocalDate date);

    /**
     * Return (date, sum(kWhUsed)) for each date for a given userId.
     * Used internally if you ever want daily totals. Not used by DTO queries above.
     */
    @Query("""
        SELECT u.date, SUM(u.kWhUsed)
        FROM EnergyUsageLog u
        WHERE u.appliance.user.id = :userId
        GROUP BY u.date
        ORDER BY u.date ASC
    """)
    List<Object[]> findTotalUsageGroupedByDate(Long userId);

    /**
     * If you ever need the raw list of all logs (not via DTO), you can add:
     */
    @Query("SELECT u FROM EnergyUsageLog u WHERE u.appliance.user.id = :userId")
    List<EnergyUsageLog> findAllByUserId(Long userId);
}
