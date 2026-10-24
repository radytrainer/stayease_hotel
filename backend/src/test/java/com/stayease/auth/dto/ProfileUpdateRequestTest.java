package com.stayease.auth.dto;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ProfileUpdateRequestTest {
    @Test void requiresANameAndLimitsThePhoneField() {
        var factory=Validation.buildDefaultValidatorFactory();
        try {
            var validator=factory.getValidator();
            assertTrue(validator.validate(new ProfileUpdateRequest("Guest",null)).isEmpty());
            assertFalse(validator.validate(new ProfileUpdateRequest(" ","1" )).isEmpty());
            assertTrue(validator.validate(new ProfileUpdateRequest("Guest","x".repeat(41))).size()>0);
        } finally { factory.close(); }
    }
}
