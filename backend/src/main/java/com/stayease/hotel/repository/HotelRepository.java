package com.stayease.hotel.repository;

import com.stayease.hotel.entity.HotelEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface HotelRepository extends JpaRepository<HotelEntity,UUID> {
    Optional<HotelEntity> findBySlugAndStatus(String slug,String status);
}

