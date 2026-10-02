output "documents_bucket" {
  value = aws_s3_bucket.documents.bucket
}

output "database_address" {
  value = aws_db_instance.app.address
}
