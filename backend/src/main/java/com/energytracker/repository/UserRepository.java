package com.energytracker.repository;

import com.energytracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;


@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    @Modifying
    @Query("UPDATE User u SET u.householdSize = :size WHERE u.id = :userId")
    void updateHouseholdSize(Long userId, int size);

    // You can add findByEmail(...) if you implement login in the future
}
