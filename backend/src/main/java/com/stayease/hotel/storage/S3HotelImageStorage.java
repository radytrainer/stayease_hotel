package com.stayease.hotel.storage;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import java.net.URI;
import java.util.UUID;

@Configuration
class S3ClientConfiguration {
    @Bean
    @ConditionalOnExpression("'${app.storage.bucket:}' != '' and '${app.storage.access-key:}' != '' and '${app.storage.secret-key:}' != ''")
    S3Client s3Client(@Value("${app.storage.region:us-east-1}")String region,
                      @Value("${app.storage.endpoint:}")String endpoint,
                      @Value("${app.storage.access-key}")String access,
                      @Value("${app.storage.secret-key}")String secret) {
        var builder=S3Client.builder().region(Region.of(region))
            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(access,secret)))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
        if(!endpoint.isBlank())builder.endpointOverride(URI.create(endpoint));
        return builder.build();
    }
}

@Component
@ConditionalOnExpression("'${app.storage.bucket:}' != '' and '${app.storage.access-key:}' != '' and '${app.storage.secret-key:}' != ''")
class S3HotelImageStorage implements HotelImageStorage {
    private final S3Client client; private final String bucket;
    S3HotelImageStorage(S3Client client,@Value("${app.storage.bucket}")String bucket){this.client=client;this.bucket=bucket;}
    @Override public void upload(UUID hotelId,String objectKey,byte[] content,String contentType){
        client.putObject(PutObjectRequest.builder().bucket(bucket).key(objectKey).contentType(contentType).build(),RequestBody.fromBytes(content));
    }
    @Override public byte[] download(String objectKey){
        try{return client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(objectKey).build()).asByteArray();}
        catch(software.amazon.awssdk.services.s3.model.NoSuchKeyException e){throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Hotel image not found");}
    }
    @Override public void delete(String objectKey){client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(objectKey).build());}
}

