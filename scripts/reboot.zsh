#!/usr/bin/env zsh

# Function to print error messages and exit
function error_exit() {
  echo "Error: $1" >&2
  exit 1
}

# Initialize variables
remote_host="cncpi.local"
remote_user="cncpi"

# Parse command-line options
while [[ "$#" -gt 0 ]]; do
  case $1 in
    *) 
      if [[ -z "$remote_host" ]]; then
        remote_host="$1"
      elif [[ -z "$remote_user" ]]; then
        remote_user="$1"
      else
        error_exit "Too many arguments provided."
      fi
      ;;
  esac
  shift
done

# Test SSH connection to the remote server
if ! ssh -q "$remote_user@$remote_host" exit; then
  error_exit "SSH connection to '$remote_user@$remote_host' failed."
fi

ssh "$remote_user@$remote_host" "sudo reboot"

echo "Reboot procedure completed successfully."