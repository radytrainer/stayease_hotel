package com.stayease.reservation.controller;

import jakarta.validation.Valid;
import com.stayease.reservation.dto.ReservationCancelRequest;
import com.stayease.reservation.service.CancellationService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reservations")
public class CancellationController {
    private final CancellationService cancellations;
    public CancellationController(CancellationService cancellations){this.cancellations=cancellations;}
    @PostMapping("/{reservationId}/cancel") @PreAuthorize("hasRole('GUEST')")
    public CancellationService.Result cancel(@AuthenticationPrincipal UUID guestId,@PathVariable UUID reservationId,@Valid @RequestBody(required=false) ReservationCancelRequest request){
        return cancellations.cancel(guestId,reservationId,request==null?null:request.reason());
    }
}

