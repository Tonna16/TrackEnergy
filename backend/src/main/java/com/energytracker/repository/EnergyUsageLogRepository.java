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
  @Query("""
        SELECT new com.energytracker.dto.UsageStats(
            AVG(u.kWhUsed)
        )
        FROM EnergyUsageLog u
        JOIN u.appliance a
        JOIN a.user user
        WHERE user.householdSize = :householdSize
        AND a.active = true
        AND a.deleted = false
    """)
    List<UsageStats> findCommunityStats(@Param("householdSize") int householdSize);
    @Modifying
    @Transactional
    @Query("DELETE FROM EnergyUsageLog e WHERE e.appliance.id = :applianceId")
    void deleteByApplianceId(@Param("applianceId") Long applianceId);
}
