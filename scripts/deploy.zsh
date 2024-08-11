#!/usr/bin/env zsh

# Function to print error messages and exit
function error_exit() {
  echo "Error: $1" >&2
  exit 1
}

# Initialize variables
delete_remote=false
local_src_dir="./src"
remote_host="cncpi.local"
remote_user="cncpi"
remote_dest_dir="/home/cncpi/.cncjs/cncjs-shopfloor-tablet"

# Parse command-line options
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -d|--delete) delete_remote=true ;;
    *) 
      if [[ -z "$local_src_dir" ]]; then
        local_src_dir="$1"
      elif [[ -z "$remote_host" ]]; then
        remote_host="$1"
      elif [[ -z "$remote_user" ]]; then
        remote_user="$1"
      elif [[ -z "$remote_dest_dir" ]]; then
        remote_dest_dir="$1"
      else
        error_exit "Too many arguments provided."
      fi
      ;;
  esac
  shift
done

# Check if the local source directory exists
if [[ ! -d "$local_src_dir" ]]; then
  error_exit "Local source directory '$local_src_dir' does not exist."
fi

# Check if SSH is installed
if ! command -v ssh >/dev/null 2>&1; then
  error_exit "SSH is not installed. Please install SSH and try again."
fi

# Check if SCP is installed
if ! command -v scp >/dev/null 2>&1; then
  error_exit "SCP is not installed. Please install SCP and try again."
fi

# Test SSH connection to the remote server
if ! ssh -q "$remote_user@$remote_host" exit; then
  error_exit "SSH connection to '$remote_user@$remote_host' failed."
fi

# Delete the remote destination directory if -d or --delete is specified
if [[ "$delete_remote" = true ]]; then
  ssh "$remote_user@$remote_host" "rm -rf '$remote_dest_dir'"
fi

# Create the remote destination directory
ssh "$remote_user@$remote_host" "mkdir -p '$remote_dest_dir'"

# Deploy the src/ folder to the remote server
scp -r "$local_src_dir" "$remote_user@$remote_host:$remote_dest_dir"

echo "Deployment completed successfully."
echo "Source directory: $local_src_dir"
echo "Remote host: $remote_host"
echo "Remote user: $remote_user"
echo "Remote destination directory: $remote_dest_dir"