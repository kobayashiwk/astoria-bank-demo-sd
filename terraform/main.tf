resource "aws_s3_bucket" "documents" {
  bucket_prefix = "${var.project_name}-documents-"
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_security_group" "web" {
  name_prefix = "${var.project_name}-web-"
  description = "Asteria Bank web access"

  ingress {
    description = "HTTPS from operations network"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.office_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "app" {
  identifier_prefix      = "${var.project_name}-"
  allocated_storage      = 20
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t3.micro"
  username               = var.db_username
  password               = var.db_password
  storage_encrypted      = false
  publicly_accessible    = true
  backup_retention_period = 0
  skip_final_snapshot    = true
}
