package com.energytracker.repository;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.UsageStats;
import com.energytracker.model.EnergyUsageLog;

import jakarta.transaction.Transactional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface EnergyUsageLogRepository extends JpaRepository<EnergyUsageLog, Long> {

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
          AND a.active = true
          AND a.deleted = false
          AND u.date BETWEEN :start AND :end
        ORDER BY u.date ASC
    """)
    List<EnergyUsageDTO> findUsageBetween(Long userId, LocalDate start, LocalDate end);

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
          AND a.active = true
          AND a.deleted = false
        ORDER BY u.date ASC
    """)
    List<EnergyUsageDTO> findUsageAll(Long userId);

    Optional<EnergyUsageLog> findByApplianceIdAndDate(Long applianceId, LocalDate date);

    @Query("""
      SELECT u FROM EnergyUsageLog u
      JOIN u.appliance a
      WHERE a.user.id = :userId
        AND a.active = true
        AND a.deleted = false
    """)
    List<EnergyUsageLog> findAllByUserId(Long userId);

    // Make this one explicit so inactive/deleted appliances are excluded when used
    @Query("""
      SELECT u FROM EnergyUsageLog u
      JOIN u.appliance a
      WHERE a.id = :applianceId
        AND a.active = true
        AND a.deleted = false
        AND u.date BETWEEN :startDate AND :endDate
      ORDER BY u.date ASC
    """)
    List<EnergyUsageLog> findByApplianceIdAndDateBetween(
        @Param("applianceId") Long applianceId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate
    );

    /**
     * Native query: for the given householdSize bucket (1..5 where 5 means 5+),
     * compute each user's daily total (sum of kwh_used per day) and return the
     * average of those daily totals.
     *
     * This prevents tiny averages caused by averaging across individual appliance logs.
     */
    @Query(value = """
        WITH user_day AS (
          SELECT usr.id AS user_id,
                 date(e.date) AS day,
                 SUM(e.kwh_used) AS total_kwh
          FROM energy_usage_logs e
          JOIN appliances a ON a.id = e.appliance_id
          JOIN users usr ON usr.id = a.user_id
          WHERE ((:householdSize < 5 AND usr.household_size = :householdSize)
                 OR (:householdSize = 5 AND usr.household_size >= 5))
            AND a.active = true
            AND a.deleted = false
          GROUP BY usr.id, date(e.date)
        )
        SELECT AVG(total_kwh) FROM user_day
        """, nativeQuery = true)
    Double findCommunityDailyAverageByHouseholdSize(@Param("householdSize") int householdSize);

    @Modifying
    @Transactional
    @Query("DELETE FROM EnergyUsageLog e WHERE e.appliance.id = :applianceId")
    void deleteByApplianceId(@Param("applianceId") Long applianceId);
}
