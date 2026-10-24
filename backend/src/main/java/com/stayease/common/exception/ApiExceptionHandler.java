package com.stayease.common.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.ResponseEntity;
import com.stayease.auth.service.LoginRateLimiter;
import java.net.URI;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail invalidInput(MethodArgumentNotValidException ex) {
        ProblemDetail problem=ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,"One or more request fields are invalid");
        problem.setTitle("Invalid request"); problem.setType(URI.create("https://stayease.invalid/problems/invalid-request")); return problem;
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail conflict(DataIntegrityViolationException ex) {
        ProblemDetail problem=ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,"The request conflicts with current data or inventory");
        problem.setTitle("Conflict"); problem.setType(URI.create("https://stayease.invalid/problems/conflict")); return problem;
    }
    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail badArgument(IllegalArgumentException ex) {
        ProblemDetail problem=ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,ex.getMessage());
        problem.setTitle("Invalid request"); return problem;
    }
    @ExceptionHandler(RestClientException.class)
    ProblemDetail providerFailure(RestClientException ex) {
        ProblemDetail problem=ProblemDetail.forStatusAndDetail(HttpStatus.BAD_GATEWAY,"The external service could not complete this request");
        problem.setTitle("External service unavailable"); return problem;
    }
    @ExceptionHandler(LoginRateLimiter.TooManyAttemptsException.class)
    ResponseEntity<ProblemDetail> tooManyAttempts(LoginRateLimiter.TooManyAttemptsException ex) {
        ProblemDetail problem=ProblemDetail.forStatusAndDetail(HttpStatus.TOO_MANY_REQUESTS,ex.getReason());
        problem.setTitle("Too many attempts"); problem.setType(URI.create("https://stayease.invalid/problems/rate-limited"));
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("Retry-After",String.valueOf(ex.retryAfterSeconds())).body(problem);
    }
    /** Reasons passed to ResponseStatusException are written for end users; surface them as problem details. */
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ProblemDetail> statusFailure(ResponseStatusException ex) {
        ProblemDetail problem=ProblemDetail.forStatusAndDetail(ex.getStatusCode(),ex.getReason()==null?"The request could not be completed":ex.getReason());
        return ResponseEntity.status(ex.getStatusCode()).headers(ex.getHeaders()).body(problem);
    }
}
