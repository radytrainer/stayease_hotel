package com.stayease.auth.dto;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PasswordChangeRequestTest {
    @Test void requiresCurrentPasswordAndAtLeastTwelveCharactersForNewPassword() {
        var factory=Validation.buildDefaultValidatorFactory();
        try {
            var validator=factory.getValidator();
            assertTrue(validator.validate(new PasswordChangeRequest("current","a-secure-new-password")).isEmpty());
            assertFalse(validator.validate(new PasswordChangeRequest("","short")).isEmpty());
            assertFalse(validator.validate(new PasswordChangeRequest("current","x".repeat(129))).isEmpty());
        } finally { factory.close(); }
    }
}
