package com.stayease.reservation.controller;

import jakarta.validation.Valid;
import com.stayease.reservation.dto.ReservationCreateRequest;
import com.stayease.reservation.dto.ReservationResponse;
import com.stayease.reservation.service.ReservationService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.UUID;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/reservations")
public class ReservationController {
    private final ReservationService service;
    public ReservationController(ReservationService service) { this.service=service; }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('GUEST')")
    public ReservationResponse create(@AuthenticationPrincipal UUID guestId, @Valid @RequestBody ReservationCreateRequest request) {
        try { return service.create(guestId, request); }
        catch (DataIntegrityViolationException e) { throw new ResponseStatusException(HttpStatus.CONFLICT, "Selected inventory is no longer available"); }
    }

    @GetMapping
    @PreAuthorize("hasRole('GUEST')")
    public List<Map<String,Object>> history(@AuthenticationPrincipal UUID guestId) { return service.history(guestId); }

    @GetMapping("/{reservationId}")
    @PreAuthorize("hasRole('GUEST')")
    public ReservationResponse details(@AuthenticationPrincipal UUID guestId,@PathVariable UUID reservationId){return service.details(guestId,reservationId);}

    @GetMapping("/{reservationId}/summary")
    @PreAuthorize("hasRole('GUEST')")
    public Map<String,Object> summary(@AuthenticationPrincipal UUID guestId,@PathVariable UUID reservationId){return service.summary(guestId,reservationId);}
}

